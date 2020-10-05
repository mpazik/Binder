import React, { useCallback } from "react";

import "./styles.css";

import { fetchLinkedDataAssets } from "../../app-logic/linked-data-assets-fetchers";
import { useQueryParams } from "../../hooks/use-query-params";
import { HashName } from "../../utils/hash";
import { LinkedDataWithHash } from "../../utils/linked-data";
import { Article } from "../article";
import { AsyncLoader } from "../async-loader";
import { Navigation } from "../navigation";

const AppWillLinkedData: React.FC<{ list: LinkedDataWithHash[] }> = ({
  list,
}) => {
  const queryParams = useQueryParams();
  const hash = (queryParams.get("url") as HashName) || list[0].hash;
  const ldWithHash = list.find((it) => it.hash === hash);
  console.log(hash, list);

  return (
    <div className="container-lg clearfix">
      <div className="col-3 float-left ">
        <Navigation list={list} current={hash} />
      </div>
      <div className="col-9 float-left border p-5">
        {ldWithHash ? (
          <Article ld={ldWithHash.ld} />
        ) : (
          <span>Could not find data</span>
        )}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AsyncLoader promise={useCallback(fetchLinkedDataAssets, [])}>
      {(list) => <AppWillLinkedData list={list} />}
    </AsyncLoader>
  );
};
