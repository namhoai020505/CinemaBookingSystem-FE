import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const fullName = localStorage.getItem('fullName');

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    navigate('/'); 
  };

  return (
    <header className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold tracking-wider hover:text-gray-200 transition">
          CINEMA
        </Link>
        <nav>
          {token ? (
            <div className="flex items-center gap-4">
              <span className="font-medium text-white">Chào, {fullName || 'Khách hàng'}!</span>
              <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-red-600 transition">
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link to="/login" className="bg-white text-blue-600 px-5 py-2 rounded-lg font-semibold shadow hover:bg-gray-100 transition">
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}