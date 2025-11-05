const crypto = require("crypto");
const User = require("../../models/user.model");
const createError = require("http-errors");

module.exports = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashToken,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) throw createError(400, "Token is invalid or expired");

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: "Password has been reset" });
  } catch (err) {
    next(err);
  }
};
