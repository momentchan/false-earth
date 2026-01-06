import { useState, useEffect, ComponentProps } from 'react';
import { Leva } from 'leva';

interface LevaWrapperProps extends Omit<ComponentProps<typeof Leva>, 'hidden'> {
    initialHidden?: boolean;
}

export default function LevaWrapper({ initialHidden = false, ...props }: LevaWrapperProps) {

    const [hidden, setHidden] = useState(initialHidden);

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.code === 'KeyH') {
                setHidden(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    return (
        <Leva theme={customTheme as any} hidden={hidden} {...props} />
    )
}

export const customTheme = {
    sizes: {
        rootWidth: '400px',
        controlHeight: '32px',
        scrubberWidth: '8px',
        scrubberHeight: '8px',

        numberInputMinWidth: '38px',
        rowHeight: '24px',
        folderTitleHeight: '20px',
        checkboxSize: '16px',
        colorPickerWidth: '$controlWidth',
        colorPickerHeight: '100px',
        titleBarHeight: '39px',
    },

    radii: {
        folder: '8px',
        control: '6px',
    },

    space: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
    },

    fontSizes: {
        root: '12px',
        label: '12px',
        toolTip: '11px',
    },

    fonts: {
        mono: 'monospace',
        sans: 'Inter, sans-serif',
    },

    colors: {
        elevation1: '#181818',
        elevation2: '#222',
        elevation3: '#333',
        accent1: '#00c9ff',
        accent2: '#555',       // slider color

        highlight1: '#fff',  // title text color
        highlight2: '#aaa',     // content text color
        highlight3: '#666',    // folder text color
    },

    borderWidths: {
        root: '0px',
        input: '1px',
        focus: '1px',
        hover: '1px',
        active: '1px',
        folder: '0px',
    },
}





export const defaultTheme = {
    colors: {
        elevation1: '#292d39', // bg color of the root panel (main title bar)
        elevation2: '#181c20', // bg color of the rows (main panel color)
        elevation3: '#373c4b', // bg color of the inputs
        accent1: '#0066dc',
        accent2: '#007bff',
        accent3: '#3c93ff',
        highlight1: '#535760',
        highlight2: '#8c92a4',
        highlight3: '#fefefe',
        vivid1: '#ffcc00',
        folderWidgetColor: '$highlight2',
        folderTextColor: '$highlight3',
        toolTipBackground: '$highlight3',
        toolTipText: '$elevation2',
    },
    radii: {
        xs: '2px',
        sm: '3px',
        lg: '10px',
    },
    space: {
        xs: '3px',
        sm: '6px',
        md: '10px',
        rowGap: '7px',
        colGap: '7px',
    },
    fonts: {
        mono: `ui-monospace, SFMono-Regular, Menlo, 'Roboto Mono', monospace`,
        sans: `system-ui, sans-serif`,
    },
    fontSizes: {
        root: '11px',
        toolTip: '$root',
    },
    sizes: {
        rootWidth: '280px',
        controlWidth: '160px',
        numberInputMinWidth: '38px',
        scrubberWidth: '8px',
        scrubberHeight: '16px',
        rowHeight: '24px',
        folderTitleHeight: '20px',
        checkboxSize: '16px',
        joystickWidth: '100px',
        joystickHeight: '100px',
        colorPickerWidth: '$controlWidth',
        colorPickerHeight: '100px',
        imagePreviewWidth: '$controlWidth',
        imagePreviewHeight: '100px',
        monitorHeight: '60px',
        titleBarHeight: '39px',
    },
    shadows: {
        level1: '0 0 9px 0 #00000088',
        level2: '0 4px 14px #00000033',
    },
    borderWidths: {
        root: '0px',
        input: '1px',
        focus: '1px',
        hover: '1px',
        active: '1px',
        folder: '1px',
    },
    fontWeights: {
        label: 'normal',
        folder: 'normal',
        button: 'normal',
    },
}