import { Navigate } from 'react-router-dom';

// Self-registration is not available in this POS system.
// User management is handled by admin users through the backoffice.
export default function RegisterPage() {
  return <Navigate to="/login" replace />;
}
