const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(err); // Log error to console
      res.status(500).json({ message: 'Server Error', error: err.message }); // Send error in response
    });
  };
};

export default asyncHandler;