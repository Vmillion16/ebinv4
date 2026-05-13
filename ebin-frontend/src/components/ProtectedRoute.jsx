const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  
  if (!user) return <Login />;
  if (requiredRole && !hasRole(user.role, requiredRole)) {
    return <AccessDenied />;
  }
  
  return children;
};
