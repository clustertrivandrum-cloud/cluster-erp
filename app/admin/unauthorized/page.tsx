export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
      <p className="mt-3 text-sm text-gray-500">
        Your account is signed in, but it does not have permission to access this admin module.
      </p>
    </div>
  );
}
