import type { View } from "linki-ui";
import { a, dangerousHtml, h2, span } from "linki-ui";

export const productIcon = `
<svg class="v-align-middle" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64" stroke="currentColor" fill="currentColor">
  <path xmlns="http://www.w3.org/2000/svg" d="M56 0H14C9.4 0 6 3.4 6 8v4H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v32H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v4c0 4.6 3.4 8 8 8h44c4.6 0 6-3.4 6-8V8c0-4.6-3.4-8-8-8zM10 56v-4h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V16h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V8c0-2.4 1.6-4 4-4h6v56h-6c-2.4 0-4-1.6-4-4zm50 0c0 2.3.302 3.323-2 4H24V4h32c2.3 0 4 1.6 4 4zm-8-44H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2zm0 10H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2z"/>
</svg>`;

export const productIconLarge = `
<svg class="v-align-middle" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 64 64" stroke="currentColor">
  <path xmlns="http://www.w3.org/2000/svg" d="M56 0H14C9.4 0 6 3.4 6 8v4H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v32H2c-1.1 0-2 .9-2 2s.9 2 2 2h4v4c0 4.6 3.4 8 8 8h44c4.6 0 6-3.4 6-8V8c0-4.6-3.4-8-8-8zM10 56v-4h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V16h4c1.1 0 2-.9 2-2s-.9-2-2-2h-4V8c0-2.4 1.6-4 4-4h6v56h-6c-2.4 0-4-1.6-4-4zm50 0c0 2.3.302 3.323-2 4H24V4h32c2.3 0 4 1.6 4 4zm-8-44H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2zm0 10H32c-1.1 0-2 .9-2 2s.9 2 2 2h20c1.1 0 2-.9 2-2s-.9-2-2-2z"/>
</svg>`;

export type ProductLogoSize = "medium" | "large";

const icon = (size: ProductLogoSize) =>
  size === "large" ? productIconLarge : productIcon;

const logoFontSize = (size: "medium" | "large") =>
  size === "large" ? "32px" : "22px";

const betaFontSize = (size: "medium" | "large") =>
  size === "large" ? "20px" : "16px";

export type ProductLogoProps = {
  size?: ProductLogoSize;
  beta?: boolean;
};
export const productLogo: View<ProductLogoProps | void> = ({
  size = "medium",
  beta = false,
} = {}) =>
  h2(
    {
      style: { fontSize: logoFontSize(size) },
    },
    a(
      { href: "/about", class: "color-text-primary no-underline" },
      dangerousHtml(icon(size)),
      span({ class: "v-align-middle" }, " docland"),
      ...(beta
        ? [
            span(
              {
                class: `v-align-middle text-light color-text-danger`,
                style: { fontSize: betaFontSize(size) },
              },
              " beta"
            ),
          ]
        : [])
    )
  );

export const productLogoBeta = productLogo({ beta: true });

export const productLogoLargeBeta = productLogo({ beta: true, size: "large" });
