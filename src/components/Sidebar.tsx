import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div style={{ width: '250px', background: '#2c3e50', color: 'white', height: '100vh', padding: '20px' }}>
      <h2>Admin Panel</h2>
      <ul style={{ listStyleType: 'none', padding: 0, marginTop: '30px' }}>
        <li style={{ marginBottom: '15px' }}>
          <Link to="/admin/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Dashboard</Link>
        </li>
        <li style={{ marginBottom: '15px' }}>
          <Link to="/admin/movies" style={{ color: 'white', textDecoration: 'none' }}>Quản lý Phim</Link>
        </li>
        <li style={{ marginBottom: '15px' }}>
          <Link to="/admin/users" style={{ color: 'white', textDecoration: 'none' }}>Quản lý User</Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;