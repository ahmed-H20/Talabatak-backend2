
export const getProtectedData = (req, res) => {
    res.json({
      message: `Welcome ${req.user.name || req.user.email || "User"}!`,
      uid: req.user.uid,
    });
  };
  
  