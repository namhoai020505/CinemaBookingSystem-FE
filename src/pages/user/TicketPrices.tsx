import { FaChair } from "react-icons/fa";
import { FiClock, FiCreditCard, FiInfo } from "react-icons/fi";

const ticketGroups = [
  {
    name: "Ghế thường",
    description: "Vị trí tiêu chuẩn, phù hợp xem phim hằng ngày.",
    weekday: "45.000 - 55.000 đ",
    weekend: "55.000 - 70.000 đ",
    note: "Giá tốt cho học sinh, sinh viên và suất chiếu sớm.",
  },
  {
    name: "Ghế VIP",
    description: "Vị trí trung tâm, góc nhìn đẹp và khoảng cách thoải mái.",
    weekday: "60.000 - 75.000 đ",
    weekend: "75.000 - 90.000 đ",
    note: "Phù hợp phim bom tấn, 2D, 3D hoặc phòng chiếu lớn.",
  },
  {
    name: "Ghế đôi",
    description: "Ghế đôi dành cho 2 khách, ưu tiên trải nghiệm riêng tư hơn.",
    weekday: "120.000 - 150.000 đ",
    weekend: "150.000 - 180.000 đ",
    note: "Giá tính theo cặp ghế, có thể thay đổi theo rạp/phòng.",
  },
];

const policyNotes = [
  "Giá vé có thể thay đổi theo định dạng phim, thời điểm chiếu và chương trình ưu đãi tại từng rạp.",
  "Ghế VIP thường nằm ở khu vực trung tâm phòng chiếu nên có giá cao hơn ghế thường.",
  "Ghế đôi được tính cho 2 người, phù hợp khi đặt vé theo cặp.",
  "Vé đã thanh toán thành công sẽ hiển thị trong mục Vé của tôi và dùng để soát vé tại rạp.",
];

export default function TicketPrices() {
  return (
    <div className="bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#182437] dark:text-white">
      <section className="px-4 pb-14 pt-8 sm:px-6 sm:pb-16">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="mb-8 border-b border-slate-200 pb-5 dark:border-white/10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0EA5E9] dark:text-[#FFD166]">
              G2Cinema
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Giá vé
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600 dark:text-white/65">
              Bảng giá dưới đây mô tả cách tính vé theo loại ghế. Ghế thường có
              mức giá cơ bản, ghế VIP có vị trí xem tốt hơn, còn ghế đôi được
              tính theo cặp ghế cho hai khách.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ticketGroups.map((group) => (
              <article
                key={group.name}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E293B]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FFD166] text-[#111827]">
                  <FaChair size={20} aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-black">{group.name}</h2>
                <p className="mt-2 min-h-[48px] text-sm font-semibold leading-6 text-slate-600 dark:text-white/60">
                  {group.description}
                </p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/[0.06]">
                    <dt className="font-bold text-slate-500 dark:text-white/55">
                      Thứ 2 - Thứ 6
                    </dt>
                    <dd className="font-black">{group.weekday}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/[0.06]">
                    <dt className="font-bold text-slate-500 dark:text-white/55">
                      Cuối tuần
                    </dt>
                    <dd className="font-black">{group.weekend}</dd>
                  </div>
                </dl>

                <p className="mt-4 text-xs font-bold leading-5 text-slate-500 dark:text-white/45">
                  {group.note}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500 dark:text-cyan-300">
                  <FiCreditCard size={19} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-black">Quy định giá vé</h2>
              </div>

              <ul className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600 dark:text-white/65">
                {policyNotes.map((note) => (
                  <li key={note} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFD166]" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>

            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-300">
                  <FiClock size={19} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-black">Lưu ý khi đặt vé</h2>
              </div>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold leading-6 text-slate-600 dark:border-white/15 dark:text-white/65">
                <FiInfo className="mb-2 text-[#FFD166]" size={18} aria-hidden="true" />
                Giá cuối cùng sẽ được hệ thống tính lại tại bước chọn ghế và
                thanh toán, dựa trên suất chiếu, loại phòng, loại ghế và ưu đãi
                đang áp dụng.
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
