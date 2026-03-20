const sendSuccess = (
  res,
  data = null,
  message = "Success",
  status = 200,
  meta = null,
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });
};

const sendError = (
  res,
  message = "Something went wrong",
  status = 500,
  code = null,
  meta = null,
) => {
  return res.status(status).json({
    success: false,
    message,
    ...(code && { code }),
    ...(meta && { meta }),
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
