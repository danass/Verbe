import toast from 'react-hot-toast';

export const notify = {
  success: (message: string) => toast.success(message, {
    duration: 3000,
    position: 'bottom-right',
  }),
  
  error: (message: string) => toast.error(message, {
    duration: 3000,
    position: 'bottom-right',
  }),
  
  info: (message: string) => toast(message, {
    duration: 3000,
    position: 'bottom-right',
  })
};
