
export const formatDateForInput = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }
  return dateStr;
};

export const formatTimeForInput = (timeStr: string | undefined): string => {
  if (!timeStr) return '';
  // Handle ISO string
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    const date = new Date(timeStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  // Handle HH:mm:ss
  if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr.substring(0, 5); 
  }
  return timeStr;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
