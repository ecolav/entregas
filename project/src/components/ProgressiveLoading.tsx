import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingStep {
  id: string;
  label: string;
  completed: boolean;
}

interface ProgressiveLoadingProps {
  steps: LoadingStep[];
  currentStep: string;
  onComplete?: () => void;
  className?: string;
}

const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  steps,
  currentStep,
  onComplete,
  className = ''
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const completedSteps = steps.filter(step => step.completed).length;
    const totalSteps = steps.length;
    const newProgress = (completedSteps / totalSteps) * 100;
    setProgress(newProgress);

    if (completedSteps === totalSteps && onComplete) {
      setTimeout(onComplete, 500); // Pequeno delay para suavizar
    }
  }, [steps, onComplete]);

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const isCurrentStep = (index: number) => index === currentStepIndex;
  const isCompleted = (index: number) => index < currentStepIndex || steps[index].completed;

  return (
    <div className={`min-h-screen bg-gray-50 flex items-center justify-center ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xl">E</span>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-xl font-semibold text-gray-900 text-center mb-6">
          Carregando Sistema
        </h2>

        {/* Barra de Progresso */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progresso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-600 to-green-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Etapas */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                isCurrentStep(index) 
                  ? 'bg-blue-50 border border-blue-200' 
                  : isCompleted(index)
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50'
              }`}
            >
              {/* Ícone */}
              <div className="flex-shrink-0">
                {isCompleted(index) ? (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : isCurrentStep(index) ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <div className="w-5 h-5 bg-gray-300 rounded-full" />
                )}
              </div>

              {/* Label */}
              <span className={`text-sm font-medium ${
                isCurrentStep(index) 
                  ? 'text-blue-700' 
                  : isCompleted(index)
                  ? 'text-green-700'
                  : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Status Atual */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {steps.find(step => step.id === currentStep)?.label || 'Inicializando...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProgressiveLoading;
