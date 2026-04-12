// 🔥 SIMPLE SPINNER COMPONENT (Add this file: src/Spinner.jsx)
const Spinner = () => (
  <div className="flex flex-col items-center space-y-4 p-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    <p className="text-gray-500">Loading dashboard...</p>
  </div>
);
