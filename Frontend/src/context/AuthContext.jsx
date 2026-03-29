import { createContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    if (userInfo) {
      setUser(userInfo);
      // Set default token for axios
      axios.defaults.headers.common["Authorization"] =
        `Bearer ${userInfo.token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post("/api/auth/login", { email, password });
    localStorage.setItem("userInfo", JSON.stringify(data));
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    setUser(data);
  };

  const register = async (name, email, password, role) => {
    const { data } = await axios.post("/api/auth/register", {
      name,
      email,
      password,
      role,
    });
    localStorage.setItem("userInfo", JSON.stringify(data));
    axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    setUser(data);
  };

  const logout = () => {
    localStorage.removeItem("userInfo");
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
