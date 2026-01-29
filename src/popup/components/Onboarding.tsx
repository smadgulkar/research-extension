import React, { useState } from 'react';
import { BookOpen, Brain, History, Lightbulb, Key, ArrowRight, Check, Sparkles } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  onOpenSettings: () => void;
}

const STEPS = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to Research Assistant',
    description: 'Your AI-powered companion for understanding web content. Analyze any page, extract key insights, and build your personal knowledge base.',
    color: 'blue',
  },
  {
    id: 'analyze',
    icon: Brain,
    title: 'Analyze Any Page',
    description: 'Get instant summaries, key points, and topic extraction from any webpage. Choose between short, medium, or long summaries based on your needs.',
    color: 'purple',
  },
  {
    id: 'knowledge',
    icon: Lightbulb,
    title: 'Build Your Knowledge Base',
    description: 'Every analysis adds to your personal knowledge base. Ask questions across all your research and get AI-powered answers.',
    color: 'amber',
  },
  {
    id: 'export',
    icon: BookOpen,
    title: 'Export Anywhere',
    description: 'Export your research as Markdown, or upgrade to Pro for JSON, HTML, Obsidian, and Notion integrations.',
    color: 'green',
  },
  {
    id: 'setup',
    icon: Key,
    title: 'Quick Setup',
    description: 'To get started, you\'ll need an API key from OpenAI or Anthropic. This powers the AI analysis and stays securely on your device.',
    color: 'indigo',
    isSetup: true,
  },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onOpenSettings }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const Icon = step.icon;

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
  };

  const colors = colorClasses[step.color];

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      onOpenSettings();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-6 pb-4">
        {STEPS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentStep(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentStep
                ? 'w-6 bg-blue-600'
                : idx < currentStep
                ? 'bg-blue-400'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className={`w-20 h-20 rounded-2xl ${colors.bg} ${colors.border} border-2 flex items-center justify-center mb-6`}>
          <Icon size={40} className={colors.text} />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {step.title}
        </h1>

        <p className="text-gray-600 max-w-sm leading-relaxed">
          {step.description}
        </p>

        {step.isSetup && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left w-full max-w-sm">
            <p className="text-sm text-gray-700 mb-2">
              <strong>Supported providers:</strong>
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" />
                OpenAI (GPT-4, GPT-3.5)
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-green-500" />
                Anthropic (Claude)
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 space-y-3">
        <button
          onClick={handleNext}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isLastStep ? (
            <>
              <Key size={18} />
              Set Up API Key
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors"
        >
          {isLastStep ? 'Skip for now' : 'Skip tour'}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
