import { TextareaHTMLAttributes, forwardRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className = '', label, error, helperText, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    <textarea
                        ref={ref}
                        className={`
                            block w-full rounded-lg border-gray-300 bg-white text-gray-900 
                            shadow-sm transition-all duration-200 ease-in-out
                            placeholder:text-gray-400 
                            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none
                            disabled:opacity-60 disabled:cursor-not-allowed
                            py-2.5 px-4 sm:text-sm
                            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {error && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}
                {helperText && !error && <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

export default Textarea;
