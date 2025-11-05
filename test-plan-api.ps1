# Plan Management API - PowerShell Test Script
# Quick API testing for Windows PowerShell

$baseUrl = "http://localhost:5000/api/plans"
$authToken = "YOUR_JWT_TOKEN_HERE"

# Color output functions
function Write-Success { param($message) Write-Host "✅ $message" -ForegroundColor Green }
function Write-Error { param($message) Write-Host "❌ $message" -ForegroundColor Red }
function Write-Info { param($message) Write-Host "ℹ️  $message" -ForegroundColor Cyan }
function Write-Warning { param($message) Write-Host "⚠️  $message" -ForegroundColor Yellow }

# API Request Helper
function Invoke-PlanApi {
    param(
        [string]$Endpoint,
        [string]$Method = "GET",
        [object]$Body = $null,
        [bool]$RequiresAuth = $true
    )
    
    $url = if ($Endpoint.StartsWith("http")) { $Endpoint } else { "$baseUrl$Endpoint" }
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($RequiresAuth -and $authToken -ne "YOUR_JWT_TOKEN_HERE") {
        $headers["Authorization"] = "Bearer $authToken"
    }
    
    try {
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return @{
            Success = $true
            Data = $response
        }
    }
    catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
            StatusCode = $_.Exception.Response.StatusCode.Value__
        }
    }
}

# Test Functions
function Test-ServerConnection {
    Write-Info "Checking server connection..."
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:5000/api/health"
        Write-Success "Server is running and healthy"
        return $true
    }
    catch {
        Write-Error "Cannot connect to server on http://localhost:5000"
        Write-Warning "Make sure your server is running"
        return $false
    }
}

function Test-PublicPlans {
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "Testing Public Endpoints (No Auth)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    
    Write-Info "GET /api/plans/public"
    $result = Invoke-PlanApi -Endpoint "/public" -RequiresAuth $false
    if ($result.Success) {
        Write-Success "Retrieved public plans"
        Write-Host "Plans found: $($result.Data.data.PSObject.Properties.Name -join ', ')" -ForegroundColor Gray
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nGET /api/plans/public?planType=mentorship"
    $result = Invoke-PlanApi -Endpoint "/public?planType=mentorship" -RequiresAuth $false
    if ($result.Success) {
        Write-Success "Retrieved mentorship plans"
        Write-Host "Count: $($result.Data.data.Count)" -ForegroundColor Gray
    } else {
        Write-Error "Failed: $($result.Error)"
    }
}

function Test-AuthenticatedEndpoints {
    if ($authToken -eq "YOUR_JWT_TOKEN_HERE") {
        Write-Warning "`nPlease set `$authToken variable with a valid JWT token"
        Write-Warning "Get a token by logging in through /api/auth/login"
        return
    }
    
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "Testing Protected Endpoints" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    
    Write-Info "GET /api/plans"
    $result = Invoke-PlanApi -Endpoint "/"
    if ($result.Success) {
        Write-Success "Retrieved all plans"
        Write-Host "Total plans: $($result.Data.pagination.total)" -ForegroundColor Gray
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nGET /api/plans/stats"
    $result = Invoke-PlanApi -Endpoint "/stats"
    if ($result.Success) {
        Write-Success "Retrieved plan statistics"
        $stats = $result.Data.data.overview
        Write-Host "Total Plans: $($stats.totalPlans)" -ForegroundColor Gray
        Write-Host "Active Plans: $($stats.activePlans)" -ForegroundColor Gray
        Write-Host "Total Subscribers: $($stats.totalSubscribers)" -ForegroundColor Gray
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nGET /api/plans/featured/active"
    $result = Invoke-PlanApi -Endpoint "/featured/active"
    if ($result.Success) {
        Write-Success "Retrieved featured plans"
        Write-Host "Count: $($result.Data.data.Count)" -ForegroundColor Gray
    } else {
        Write-Error "Failed: $($result.Error)"
    }
}

function Test-CreatePlan {
    if ($authToken -eq "YOUR_JWT_TOKEN_HERE") { return }
    
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "Testing CRUD Operations" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $testPlan = @{
        name = "test-plan-$timestamp"
        displayName = "PowerShell Test Plan"
        description = "Created via PowerShell test script"
        planType = "subscription"
        category = "basic"
        pricing = @{
            monthly = @{
                price = 29.99
                originalPrice = 39.99
                discount = "25% OFF"
                savings = 10
            }
        }
        features = @(
            "PowerShell Feature 1",
            "PowerShell Feature 2",
            "PowerShell Feature 3"
        )
        ui = @{
            icon = "star"
            gradient = "from-blue-500 to-purple-600"
            color = "blue"
            badgeText = "Test"
            badgeColor = "blue"
        }
        isActive = $true
        tags = @("test", "powershell")
    }
    
    Write-Info "POST /api/plans - Creating test plan"
    $result = Invoke-PlanApi -Endpoint "/" -Method "POST" -Body $testPlan
    if ($result.Success) {
        Write-Success "Plan created successfully"
        $planId = $result.Data.data._id
        Write-Host "Plan ID: $planId" -ForegroundColor Gray
        return $planId
    } else {
        Write-Error "Failed to create plan: $($result.Error)"
        return $null
    }
}

function Test-PlanOperations {
    param([string]$planId)
    
    if (-not $planId) { return }
    
    Write-Info "`nGET /api/plans/$planId"
    $result = Invoke-PlanApi -Endpoint "/$planId"
    if ($result.Success) {
        Write-Success "Retrieved plan by ID"
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nPUT /api/plans/$planId/feature - Toggle featured"
    $result = Invoke-PlanApi -Endpoint "/$planId/feature" -Method "PUT"
    if ($result.Success) {
        Write-Success "Toggled featured status"
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nPUT /api/plans/$planId/popular - Toggle popular"
    $result = Invoke-PlanApi -Endpoint "/$planId/popular" -Method "PUT"
    if ($result.Success) {
        Write-Success "Toggled popular status"
    } else {
        Write-Error "Failed: $($result.Error)"
    }
}

function Test-DeletePlan {
    param([string]$planId)
    
    if (-not $planId) { return }
    
    Write-Host "`n========================================" -ForegroundColor Yellow
    Write-Host "Cleanup - Delete Test Plan" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    
    Write-Info "DELETE /api/plans/$planId (soft delete)"
    $result = Invoke-PlanApi -Endpoint "/$planId" -Method "DELETE"
    if ($result.Success) {
        Write-Success "Plan soft deleted"
    } else {
        Write-Error "Failed: $($result.Error)"
    }
    
    Write-Info "`nDELETE /api/plans/$planId?permanent=true"
    $result = Invoke-PlanApi -Endpoint "/${planId}?permanent=true" -Method "DELETE"
    if ($result.Success) {
        Write-Success "Plan permanently deleted"
    } else {
        Write-Error "Failed: $($result.Error)"
    }
}

# Main Test Execution
function Start-PlanApiTests {
    Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
    Write-Host "🚀 Plan Management API - Test Suite" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    
    # Check server connection
    if (-not (Test-ServerConnection)) {
        return
    }
    
    # Test public endpoints
    Test-PublicPlans
    
    # Test authenticated endpoints
    Test-AuthenticatedEndpoints
    
    # Test CRUD operations
    $planId = Test-CreatePlan
    
    # Test plan operations
    if ($planId) {
        Test-PlanOperations -planId $planId
        Test-DeletePlan -planId $planId
    }
    
    Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
    Write-Host "✅ Test Suite Completed" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

# Run the tests
Start-PlanApiTests
