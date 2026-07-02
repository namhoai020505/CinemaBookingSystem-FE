import { TEXT } from '../../constants/vi';

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">{TEXT.DASHBOARD.TITLE}</h1>
      <p className="mt-4 text-gray-600">{TEXT.DASHBOARD.SUBTITLE}</p>
    </div>
  );
}