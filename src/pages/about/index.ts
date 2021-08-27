import "./styles.css";

import { productLogo } from "../../components/logo";
import { navigationView } from "../../components/navigation";
import {
  a,
  b,
  ComponentBody,
  div,
  footer,
  fragment,
  img,
  JsonHtml,
  p,
  small,
  source,
  span,
  video,
} from "../../libs/simple-ui/render";

const header = div(
  {
    class: "marketing-content px-2 my-8",
  },
  div(
    { class: "d-flex flex-items-center", style: { gap: "48px" } },
    div(
      { style: { flex: "2" } },
      p({ class: "h3-mktg" }, "Single place for your documents"),
      p(
        { class: "f3-mktg" },
        "All your ",
        b("articles, ebooks, notes"),
        " in ONE place; synchronized with your cloud drive, with full privacy, display preferences, personal comments, search, categorization, and offline access\n"
      ),
      // p({ class: "f3-mktg" }, "Boost your research and learning!"),
      div(
        { class: "f3 mt-4" },
        a(
          { href: "/directory", class: "btn btn-large  btn-primary px-4 py-2" },
          "Go to docland"
        )
      )
    ),
    div(
      { style: { flex: "3" } },

      video(
        {
          class: "color-shadow-extra-large",
          autoplay: undefined,
          muted: undefined,
          controls: undefined,
          style: { width: "100%", borderRadius: "4px" },
        },
        source({
          src: "docland-demo.webm",
          type: "video/webm",
        }),
        "Your browser does not support HTML5 video."
      )
    )
  )
);

const featureSection = (title: string, description: JsonHtml, imgSrc: string) =>
  div(
    { class: "flex-1" },
    img({
      src: imgSrc,
      style: { maxWidth: "100%", filter: "saturate(80%)" },
      class: "mb-4 color-shadow-medium",
    }),
    p({ class: "h5-mktg" }, title),
    p({ class: "f4-mktg" }, description)
  );

const features = div(
  {
    class: "color-bg-secondary px-2 py-8",
  },
  div(
    {
      class: "marketing-content d-flex flex-column",
      style: { gap: "48px" },
    },
    div(
      {
        class: "d-flex",
        style: { gap: "64px" },
      },
      featureSection(
        "Read on your terms",
        "Stretched text, small font, clutter on the page? Docland cleans up all the noise and leaves only the pure content displayed to your preferences.",
        "display.png"
      ),
      featureSection(
        "Speed up learning",
        span(
          "Do active reading and quick review by adding ",
          b("highlights and comments"),
          " to articles and books. Remember information quickly and for a long time",
          "."
        ),
        "annotations.png"
      ),
      featureSection(
        "Organize your research",
        span(
          "With ",
          b("PDF and EPUB format support"),
          ", you can easily store and organize your research materials in a single place."
        ),
        "pdf.png"
      )
    ),
    div(
      {
        class: "d-flex",
        style: { gap: "64px" },
      },
      featureSection(
        "Save forever",
        span(
          "Never lose your favorite articles. Docland uses your personal cloud drive to store information in open file formats, which guarantees the access to your data forever."
        ),
        "save.png"
      ),
      featureSection(
        "Instant response",
        "No more loading screens to access a recent page. Docland keeps a copy of data on your device to give you search results instantly.",
        "instant.png"
      ),
      featureSection(
        "Own your data",
        span(
          "No one besides you has access to your data. Docland does not store any of your information, and its code is ",
          a(
            { href: "https://github.com/mpazik/docland" },
            "publicly available"
          ),
          "."
        ),
        "privacy.png"
      )
    ),
    div(
      { class: "f4 color-text-danger" },
      "* Docland is in beta version; not all of the features are fully implemented yet."
    )
  )
);

const mission = div(
  { class: "marketing-content px-2 my-8" },
  p({ class: "h4-mktg" }, "Take control over your data"),
  p({ class: "f3" }, "Docland mission is to give you control over your data."),
  p(
    { class: "f3" },
    "We plan to extend the application with sharing capabilities and add the option to capture notes and structured information."
  ),
  p(
    { class: "f3" },
    "If you need better control of your information, ",
    a(
      {
        href: "https://discord.com/channels/876828347492073543",
        target: "_blank",
      },
      "join our community"
    ),
    " and ",
    a(
      { href: "https://twitter.com/DoclandHQ", target: "_blank" },
      "follow the project"
    )
  )
);

const mailLogo = `<svg id="mail" viewBox="0 0 14 16" style="width: auto" fill="#f97583">
<path fill-rule="evenodd" d="M0 4v8c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1H1c-.55 0-1 .45-1 1zm13 0L7 9 1 4h12zM1 5.5l4 3-4 3v-6zM2 12l3.5-3L7 10.5 8.5 9l3.5 3H2zm11-.5l-4-3 4-3v6z"></path>
  </svg>`;

const githubLogo = `<svg xmlns="http://www.w3.org/2000/svg" fill="#000" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="24"/>
  <path fill="#fff" fill-rule="evenodd" d="M31.4225 46.8287C29.0849 47.589 26.5901 48 24 48C21.4081 48 18.9118 47.5884 16.5728 46.8272C17.6533 46.9567 18.0525 46.2532 18.0525 45.6458C18.0525 45.3814 18.048 44.915 18.0419 44.2911C18.035 43.5692 18.0259 42.6364 18.0195 41.5615C11.343 43.0129 9.9345 38.3418 9.9345 38.3418C8.844 35.568 7.2705 34.8294 7.2705 34.8294C5.091 33.3388 7.4355 33.369 7.4355 33.369C9.843 33.5387 11.1105 35.8442 11.1105 35.8442C13.2525 39.5144 16.728 38.4547 18.096 37.8391C18.3135 36.2871 18.9345 35.2286 19.62 34.6283C14.2905 34.022 8.688 31.9625 8.688 22.7597C8.688 20.1373 9.6225 17.994 11.1585 16.3142C10.911 15.7065 10.0875 13.2657 11.3925 9.95888C11.3925 9.95888 13.4085 9.31336 17.9925 12.4206C19.908 11.8876 21.96 11.6222 24.0015 11.6114C26.04 11.6218 28.0935 11.8876 30.0105 12.4206C34.5915 9.31336 36.603 9.95888 36.603 9.95888C37.9125 13.2657 37.089 15.7065 36.8415 16.3142C38.3805 17.994 39.309 20.1373 39.309 22.7597C39.309 31.9849 33.6975 34.0161 28.3515 34.6104C29.2125 35.3519 29.9805 36.8168 29.9805 39.058C29.9805 41.2049 29.9671 43.0739 29.9582 44.3125C29.9538 44.9261 29.9505 45.385 29.9505 45.6462C29.9505 46.2564 30.3401 46.9613 31.4225 46.8287Z" clip-rule="evenodd"/>
</svg>`;
const twitterLogo = `<svg xmlns="http://www.w3.org/2000/svg" fill="#03a9f4" viewBox="0 0 98.488 80.021">
  <path d="M98.488,57.473a42.1,42.1,0,0,1-11.634,3.189A20.078,20.078,0,0,0,95.736,49.5a40.35,40.35,0,0,1-12.8,4.887A20.189,20.189,0,0,0,48.007,68.2a20.79,20.79,0,0,0,.468,4.6A57.15,57.15,0,0,1,6.857,51.681a20.2,20.2,0,0,0,6.2,26.986A19.94,19.94,0,0,1,3.939,76.18V76.4A20.284,20.284,0,0,0,20.116,96.241a20.152,20.152,0,0,1-5.294.665A17.853,17.853,0,0,1,11,96.561a20.383,20.383,0,0,0,18.867,14.065,40.57,40.57,0,0,1-25.034,8.612A37.819,37.819,0,0,1,0,118.96a56.843,56.843,0,0,0,30.974,9.061c37.154,0,57.468-30.777,57.468-57.455,0-.893-.031-1.754-.074-2.61A40.28,40.28,0,0,0,98.488,57.473Z" transform="translate(0 -48)"/>
</svg>`;

const discordLogo = `<svg xmlns="http://www.w3.org/2000/svg" fill="#7289da" aria-label="Discord" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="15%"/>
  <path fill="#fff" d="m346 392-21-25c41-11 57-39 57-39-52 49-194 51-249 0 0 0 14 26 56 39l-23 25c-70-1-97-48-97-48 0-104 46-187 46-187 47-33 90-33 90-33l3 4c-58 16-83 42-83 42 68-46 208-42 263 0 1-1-33-28-86-42l5-4s43 0 90 33c0 0 46 83 46 187 0 0-27 47-97 48z"/><ellipse cx="196" cy="279" rx="33" ry="35"/>
  <ellipse cx="312" cy="279" rx="33" ry="35"/>
</svg>`;

const contactList = [
  a({
    href: "https://twitter.com/DoclandHQ",
    title: "Follow us on twitter",
    dangerouslySetInnerHTML: twitterLogo,
    target: "_blank",
  }),
  a({
    href: "https://discord.com/channels/876828347492073543",
    title: "Let's chat on Discord",
    dangerouslySetInnerHTML: discordLogo,
    target: "_blank",
  }),
  a({
    href: "https://github.com/mpazik/docland/issues",
    title: "Check Docland repository",
    dangerouslySetInnerHTML: githubLogo,
    target: "_blank",
  }),
  a({
    href: "mailto:hello@docland.app",
    title: "Email Docland team",
    dangerouslySetInnerHTML: mailLogo,
    target: "_blank",
  }),
];
const contact = div(
  { class: "marketing-content px-2 my-8" },
  p({ class: "h4-mktg mb-6" }, "Let's stay in touch"),
  div(
    {
      class: "community d-flex flex-items-center width-full px-6",
      style: { gap: "15%" },
    },
    ...contactList
  )
);

const footerView = footer(
  { class: "color-bg-tertiary px-2 py-3" },
  div(
    { class: "marketing-content d-flex flex-justify-center flex-items-center" },
    small({
      dangerouslySetInnerHTML:
        "&copy; Copyright 2021, Docland. All Rights Reserved &nbsp;",
    }),
    productLogo()
  )
);

export const AboutPage: ComponentBody<void> = (render) => {
  render(
    fragment(
      navigationView({
        // position: "fixed",
        productLogoSize: "large",
        body: fragment(),
        // span({ class: "f3-mktg" }, "Let's stay in touch"),
        // navLogos
      }),
      div({ class: "pt-8" }),
      header,
      features,
      mission,
      contact,
      footerView
    )
  );
};
