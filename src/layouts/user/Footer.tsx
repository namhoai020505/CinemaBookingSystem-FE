export default function Footer() {
  return (
    // Footer user hiển thị chính sách, cụm rạp và thông tin liên hệ.
    <footer className="bg-[#0F172A] text-gray-300 py-10 text-sm border-t border-gray-800">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Cột chính sách của rạp. */}
        <div>
          <h4 className="font-bold text-white mb-4 uppercase">Chính sách</h4>
          <ul className="space-y-2">
            <li className="hover:text-white cursor-pointer transition">Tuyển dụng</li>
            <li className="hover:text-white cursor-pointer transition">Giới thiệu</li>
            <li className="hover:text-white cursor-pointer transition">Liên hệ</li>
            <li className="hover:text-white cursor-pointer transition">Điều khoản sử dụng</li>
          </ul>
        </div>

        {/* Cột cụm rạp, chiếm 2 cột trên desktop. */}
        <div className="md:col-span-2">
          <h4 className="font-bold text-white mb-4 uppercase">Cụm rạp</h4>
          <div className="grid grid-cols-2 gap-2">
            <p className="hover:text-white cursor-pointer transition">› Rạp Hà Nội</p>
            <p className="hover:text-white cursor-pointer transition">› Rạp TP HCM</p>
            <p className="hover:text-white cursor-pointer transition">› Rạp Thái Nguyên</p>
            <p className="hover:text-white cursor-pointer transition">› Rạp Thanh Hóa</p>
          </div>
        </div>

        {/* Cột liên hệ và social placeholder. */}
        <div>
          <h4 className="font-bold text-white mb-4 uppercase">Liên hệ</h4>
          <p className="mb-2"><strong>Hotline:</strong> 1900 1234</p>
          <p className="mb-2"><strong>Email:</strong> cskh@cinema.vn</p>
          <h4 className="font-bold text-white mt-6 mb-4 uppercase">Kết nối với chúng tôi</h4>
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
            <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
            <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </footer>
  );
}
