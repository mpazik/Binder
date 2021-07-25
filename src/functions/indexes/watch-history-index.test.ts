import { WatchAction } from "../../components/watch-history/watch-action";
import { HashUri } from "../../libs/hash";
import { LinkedDataWithHashId } from "../../libs/jsonld-format";

import { index } from "./watch-history-index";

const watchActionLd: WatchAction & LinkedDataWithHashId = {
  "@context": "https://schema.org",
  "@type": "WatchAction",
  "@id": "nih:sha-256;1e784540af3bcf44ce196c327d6ffcec8aab064fe3d030c9913905e3243adffe" as HashUri,
  startTime: "2021-07-25T09:11:52.680Z",
  endTime: "2021-07-25T09:12:44.692Z",
  target:
    "nih:sha-256;a640336a3f643b0cc0f1648218ad881e8f28ea12bd010603c07009c9995347ec#content",
};

describe("watch history indexer", () => {
  test("should recognise and index WatchAction", async () => {
    const indexingProps = index(watchActionLd);

    expect(indexingProps).toEqual({
      props: {
        fragment: "content",
        uri:
          "nih:sha-256;a640336a3f643b0cc0f1648218ad881e8f28ea12bd010603c07009c9995347ec",
        startTime: "2021-07-25T09:11:52.680Z",
        endTime: "2021-07-25T09:12:44.692Z",
      },
      hash:
        "nih:sha-256;a640336a3f643b0cc0f1648218ad881e8f28ea12bd010603c07009c9995347ec",
    });
  });

  test("should recognise and index WatchAction without start and end time", async () => {
    // eslint-disable-next-line unused-imports/no-unused-vars-ts,@typescript-eslint/no-unused-vars
    const { startTime, endTime, ...rest } = watchActionLd;
    const indexingProps = index(rest);

    expect(indexingProps).toEqual({
      props: {
        fragment: "content",
        uri:
          "nih:sha-256;a640336a3f643b0cc0f1648218ad881e8f28ea12bd010603c07009c9995347ec",
      },
      hash:
        "nih:sha-256;a640336a3f643b0cc0f1648218ad881e8f28ea12bd010603c07009c9995347ec",
    });
  });

  test("should ignore other linked data type", async () => {});

  test("should ignore WatchAction without target", async () => {});
});
