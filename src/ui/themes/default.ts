export interface Theme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  text: string;
  dimText: string;
  border: string;
  background: string;
  cardBackground: string;
}

export const defaultTheme: Theme = {
  primary: '#00BFA5',
  secondary: '#7C4DFF',
  success: '#00E676',
  warning: '#FFAB40',
  error: '#FF5252',
  text: '#E0E0E0',
  dimText: '#757575',
  border: '#424242',
  background: '#121212',
  cardBackground: '#1E1E1E',
};
