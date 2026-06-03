import { useNavigate } from 'react-router-dom';

const Topbar = () => {
  const navigate = useNavigate();
  
  // Lấy tên thật từ localStorage, nếu không có thì để mặc định là 'Chưa đăng nhập'
  const fullName = localStorage.getItem('fullName') || 'Quản trị viên';

  const handleLogout = () => {
    // Xóa sạch dấu vết khi logout
    localStorage.removeItem('accessToken');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    navigate('/');
  };

  return (
    <div style={{ 
      height: '60px', background: '#ecf0f1', 
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      padding: '0 20px', borderBottom: '1px solid #ccc'
    }}>
      {/* Hiển thị tên thật ở đây */}
      <span style={{ marginRight: '20px', fontWeight: 'bold' }}>Xin chào, {fullName}</span>
      
      <button 
        onClick={handleLogout}
        style={{ padding: '8px 16px', cursor: 'pointer', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Đăng xuất
      </button>
    </div>
  );
};

export default Topbar;