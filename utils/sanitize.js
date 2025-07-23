export const sanitizeUser = (user) => {
  return {
    id: user._id?.toString?.() || null,
    name: user.name,
    phone: user.phone,
    location: user.location,
    isPhoneVerified: user.isPhoneVerified,
    status: user.status,
    profile_picture: user.profile_picture,
    createdAt: normalizeDate(user.createdAt),
  };
};

const normalizeDate = (date) => {
  if (!date) return null;
  if (typeof date === "string") return date;
  if (date instanceof Date) return date.toISOString();
  if (typeof date === "object" && "$date" in date) return date.$date;
  return new Date().toISOString();
};
