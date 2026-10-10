import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="card authcard" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="muted" style={{ margin: '8px 0 18px' }}>The page you are looking for does not exist or has moved.</p>
        <Link to="/" className="btn primary">Go to home</Link>
      </div>
    </div>
  );
}
