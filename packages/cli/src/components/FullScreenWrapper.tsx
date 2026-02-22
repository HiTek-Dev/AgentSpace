import React, { useEffect, useState } from "react";
import { Box, useStdout } from "ink";

interface FullScreenWrapperProps {
	children: (dimensions: { width: number; height: number }) => React.ReactNode;
}

/**
 * Fullscreen terminal wrapper using alternate screen buffer.
 *
 * On mount: enters alternate screen buffer and hides the hardware cursor
 * (Ink manages its own cursor rendering).
 * On unmount: restores the cursor and leaves alternate screen buffer.
 *
 * Tracks terminal dimensions via stdout resize events and passes them
 * to children via render prop for layout calculations.
 */
export function FullScreenWrapper({ children }: FullScreenWrapperProps) {
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState({
		width: stdout?.columns ?? 80,
		height: stdout?.rows ?? 24,
	});

	useEffect(() => {
		// Enter alternate screen buffer
		process.stdout.write("\x1b[?1049h");
		// Hide hardware cursor (Ink manages its own)
		process.stdout.write("\x1b[?25l");

		const handleResize = () => {
			setDimensions({
				width: stdout?.columns ?? 80,
				height: stdout?.rows ?? 24,
			});
		};

		stdout?.on("resize", handleResize);

		return () => {
			stdout?.off("resize", handleResize);
			// Show hardware cursor
			process.stdout.write("\x1b[?25h");
			// Leave alternate screen buffer
			process.stdout.write("\x1b[?1049l");
		};
	}, [stdout]);

	return (
		<Box flexDirection="column" width={dimensions.width} height={dimensions.height}>
			{children(dimensions)}
		</Box>
	);
}
