export const attachSocket = (io) => (req, _res, next) => {
  req.io = io;
  next();
};

export default attachSocket;
