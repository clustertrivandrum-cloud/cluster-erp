import { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    helperText?: string;
    options?: { label: string; value: string | number }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = '', label, error, helperText, options, children, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {label}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        className={`
                            block w-full rounded-lg border-gray-300 bg-white text-gray-900 
                            shadow-sm transition-all duration-200 ease-in-out
                            placeholder:text-gray-400 
                            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none
                            disabled:opacity-60 disabled:cursor-not-allowed
                            py-2.5 px-4 sm:text-sm
                            appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236B7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.75rem_center] pr-10
                            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}
                            ${className}
                        `}
                        {...props}
                    >
                        {options
                            ? options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))
                            : children}
                    </select>
                </div>
                {error && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}
                {helperText && !error && <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>}
            </div>
        );
    }
);

Select.displayName = 'Select';

export default Select;
