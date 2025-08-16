import { useNavigate } from 'react-router-dom';

/**
 * Custom hook for handling sidebar navigation
 * @param {string} currentSection - The current active section
 * @returns {function} handleSectionChange - Navigation handler function
 */
export const useNavigation = (currentSection = null) => {
  const navigate = useNavigate();

  const handleSectionChange = (section) => {
    // Don't navigate if we're already on the current section
    if (section === currentSection) {
      return;
    }

    // Handle navigation based on section
    switch (section) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'communication':
        navigate('/communication');
        break;
      case 'reservation-management':
        navigate('/reservation');
        break;
      case 'cleaning-management':
      case 'cleaning':
        navigate('/cleaning');
        break;
      case 'properties':
        navigate('/property');
        break;
      case 'users':
        navigate('/user');
        break;
      default:
        // Default fallback to dashboard
        navigate('/dashboard');
        break;
    }
  };

  return handleSectionChange;
};

export default useNavigation;
