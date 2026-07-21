import api from '../lib/api';

export interface ChatbotResponsePayload {
  response?: string;
  message?: string;
  reply?: string;
  text?: string;
}

export interface ChatbotApiResponse {
  success: boolean;
  data?: ChatbotResponsePayload | string;
  response?: string;
  message?: string;
  reply?: string;
  text?: string;
}

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
      response?: string;
    };
  };
  message?: string;
};

const getChatbotErrorMessage = (error: unknown) => {
  const apiError = error as ApiErrorLike;
  return (
    apiError.response?.data?.message ||
    apiError.response?.data?.response ||
    apiError.message ||
    'Không thể kết nối tới chatbot lúc này.'
  );
};

export const chatbotService = {
  sendMessage: async (message: string): Promise<string> => {
    try {
      const response = await api.post<unknown, ChatbotApiResponse | string>('/api/Chatbot', { message });
      
      // Handle various potential backend response formats
      if (typeof response === 'string') {
        return response;
      }
      
      if (response && typeof response === 'object') {
        // If wrapped in ApiResponse structure
        if (response.success && response.data) {
          const data = response.data;
          if (typeof data === 'string') return data;
          if (typeof data === 'object') {
            return data.response || data.reply || data.message || data.text || JSON.stringify(data);
          }
        }
        
        // Direct response properties
        return response.response || response.reply || response.message || response.text || JSON.stringify(response);
      }
      
      return 'Xin lỗi, tôi gặp sự cố khi kết nối với máy chủ.';
    } catch (error) {
      console.error('Chatbot API Error:', error);
      return `Lỗi: ${getChatbotErrorMessage(error)}`;
    }
  }
};
