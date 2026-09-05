module.exports = (err, req, res, next) => {
  console.error("ERROR:", err.message);

  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  const response = {
    success: false,
    message:
      process.env.NODE_ENV === "production" && isServerError
        ? "Something went wrong. Please try again."
        : err.message || "Internal Server Error",
  };

  if (!isServerError && err.code) {
    response.code = err.code; // provider / business error code
  }

  if (!isServerError && err.details?.length) {
    response.details = err.details;
  }

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};
