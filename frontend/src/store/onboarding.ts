import { create } from 'zustand';

interface OnboardingState {
  isCompleted: boolean;
  currentStep: number;
  setCompleted: (completed: boolean) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
}

// Load from localStorage
const loadOnboardingState = () => {
  try {
    const stored = localStorage.getItem('onboarding-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isCompleted: parsed.isCompleted || false,
        currentStep: parsed.currentStep || 0,
      };
    }
  } catch (e) {
    console.error('Failed to load onboarding state:', e);
  }
  return { isCompleted: false, currentStep: 0 };
};

const initialState = loadOnboardingState();

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isCompleted: initialState.isCompleted,
  currentStep: initialState.currentStep,
  setCompleted: (completed) => {
    set({ isCompleted: completed });
    localStorage.setItem('onboarding-storage', JSON.stringify({
      isCompleted: completed,
      currentStep: initialState.currentStep,
    }));
  },
  setCurrentStep: (step) => {
    set({ currentStep: step });
    const stored = localStorage.getItem('onboarding-storage');
    const parsed = stored ? JSON.parse(stored) : {};
    localStorage.setItem('onboarding-storage', JSON.stringify({
      ...parsed,
      currentStep: step,
    }));
  },
  reset: () => {
    set({ isCompleted: false, currentStep: 0 });
    localStorage.setItem('onboarding-storage', JSON.stringify({
      isCompleted: false,
      currentStep: 0,
    }));
  },
}));
