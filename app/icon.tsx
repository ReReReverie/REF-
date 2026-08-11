import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#10100f",
        color: "#faf9f4",
        display: "flex",
        fontFamily: "Arial, sans-serif",
        fontSize: 210,
        fontWeight: 900,
        height: "100%",
        justifyContent: "center",
        letterSpacing: "-0.12em",
        paddingRight: 28,
        width: "100%",
      }}
    >
      R!
    </div>,
    size,
  );
}
