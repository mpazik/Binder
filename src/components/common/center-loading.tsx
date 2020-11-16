import React, { useEffect, useState } from "react";

export const CenterLoading = () => {
  const [enabled, enable] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => {
      enable(true);
    }, 300);
    return () => {
      clearTimeout(timeout);
    };
  });
  return enabled ? (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "30%",
        transform: "translateX(-50%)",
      }}
      className="loading black"
    />
  ) : (
    <React.Fragment />
  );
};
