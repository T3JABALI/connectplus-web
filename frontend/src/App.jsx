import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Home from './pages/Home.jsx';
import Buy from './pages/Buy.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Referral from './pages/Referral.jsx';
import Help from './pages/Help.jsx';
import Login from './pages/Login.jsx';
import RefCapture from './pages/RefCapture.jsx';
import NotFound from './pages/NotFound.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="buy" element={<Buy />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="referral" element={<RequireAuth><Referral /></RequireAuth>} />
        <Route path="help" element={<Help />} />
        <Route path="admin" element={<Admin />} />
        <Route path="login" element={<Login />} />
        <Route path="ref/:code" element={<RefCapture />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
