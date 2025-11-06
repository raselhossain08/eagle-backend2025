const crypto = require("crypto");
const User = require("../../user/models/user.model");
const sendEmail = require("../../utils/sendEmail");
const createError = require("http-errors");

module.exports = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, "Email is required");

    const user = await User.findOne({ email });
    if (!user) throw createError(404, "User not found");

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetToken = hashToken;
    user.resetTokenExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail(
      email,
      "Password Reset",
      `<p>Click <a href="${resetUrl}">here</a> to reset your password</p>`
    );

    res.json({ success: true, message: "Reset email sent" });
  } catch (err) {
    next(err);
  }
};
