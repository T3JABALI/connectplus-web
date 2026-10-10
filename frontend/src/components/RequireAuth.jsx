import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { account, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="wrap"><p className="muted" style={{ padding: '40px 0' }}>Loading your account…</p></div>;
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
