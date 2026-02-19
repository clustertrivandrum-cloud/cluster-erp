import { LabelHTMLAttributes, forwardRef } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> { }

const Label = forwardRef<HTMLLabelElement, LabelProps>(
    ({ className = '', children, ...props }, ref) => {
        return (
            <label
                ref={ref}
                className={`block text-sm font-medium text-gray-700 mb-1.5 ${className}`}
                {...props}
            >
                {children}
            </label>
        );
    }
);

Label.displayName = 'Label';

export default Label;
