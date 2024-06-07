import fs from "fs";
import path from "path";
import { SsrSite, SsrSiteNormalizedProps, SsrSiteProps } from "./SsrSite.js";
import { Construct } from "constructs";

export interface AngularSiteProps extends SsrSiteProps {
  /**
   * The server function is deployed to Lambda in a single region. Alternatively, you can enable this option to deploy to Lambda@Edge.
   * @default false
   */
  edge?: boolean;
}

type AngularSiteNormalizedProps = AngularSiteProps &
  SsrSiteNormalizedProps;

/**
 * The `AngularSite` construct is a higher level CDK construct that makes it easy to create a Angular app with SSR Rendering.
 * @example
 * Deploys a Angular app in the `my-angular-app` directory.
 *
 * ```js
 * new AngularSite(stack, "web", {
 *   path: "my-angular-app/",
 * });
 * ```
 */
export class AngularSite extends SsrSite {
  declare props: AngularSiteNormalizedProps;

  constructor(scope: Construct, id: string, props?: AngularSiteProps) {
    super(scope, id, props);
  }

  protected plan() {
    const { path: sitePath, edge } = this.props;
    //check if the server folder exists
    if (!fs.existsSync(path.join(sitePath, "dist", "server"))) {
    }
    const serverConfig = fs.existsSync(path.join(sitePath, "dist", "server")) ?{
      description: "Server handler for Angular",
      handler: path.join(sitePath, "dist", "server", "server.handler"),
    }: undefined;

    return this.validatePlan({
      edge: edge ?? false,
      cloudFrontFunctions: {
        serverCfFunction: {
          constructId: "CloudFrontFunction",
          injections: [this.useCloudFrontFunctionHostHeaderInjection()],
        },
      },
      edgeFunctions: edge && serverConfig
        ? {
            edgeServer: {
              constructId: "Server",
              function: {
                scopeOverride: this as AngularSite,
                ...serverConfig,
              },
            },
          }
        : undefined,
      origins: {
        ...(edge && serverConfig
          ? {}
          : {
              regionalServer: {
                type: "function" as const,
                constructId: "ServerFunction",
                function: serverConfig,
              },
            }),
        s3: {
          type: "s3" as const,
          copy: [
            {
              from: "dist/browser",
              to: "",
              cached: true,
              versionedSubDir: "assets",
            },
          ],
        },
      },
      behaviors: [
        serverConfig ?
        edge
          ? {
              cacheType: "server" as const,
              cfFunction: "serverCfFunction",
              edgeFunction: "edgeServer",
              origin: "s3",
            }
          : {
              cacheType: "server" as const,
              cfFunction: "serverCfFunction",
              origin: "regionalServer",
            } : undefined,
        // create 1 behaviour for each top level asset file/folder
        ...fs.readdirSync(path.join(sitePath, "dist/browser")).map(
          (item) =>
            ({
              cacheType: "static",
              pattern: fs
                .statSync(path.join(sitePath, "dist/browser", item))
                .isDirectory()
                ? `${item}/*`
                : item,
              origin: "s3",
            } as const)
        ),
      ],
    });
  }

  public getConstructMetadata() {
    return {
      type: "AngularSite" as const,
      ...this.getConstructMetadataBase(),
    };
  }
}
