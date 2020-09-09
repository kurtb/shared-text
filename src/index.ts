/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

// set the base path for all dynamic imports first
// eslint-disable-next-line import/no-unassigned-import
import "./publicpath";

import assert from "assert";
import { IContainerContext, IRuntime, IRuntimeFactory } from "@fluidframework/container-definitions";
import { ContainerRuntime } from "@fluidframework/container-runtime";
import {
    IFluidDataStoreContext,
    IFluidDataStoreFactory,
    IFluidDataStoreRegistry,
    IProvideFluidDataStoreFactory,
    IProvideFluidDataStoreRegistry,
    NamedFluidDataStoreRegistryEntries,
} from "@fluidframework/runtime-definitions";
import {
    deprecated_innerRequestHandler,
    buildRuntimeRequestHandler,
} from "@fluidframework/request-handler";
import { defaultRouteRequestHandler } from "@fluidframework/aqueduct";
import * as sharedTextComponent from "./component";

const DefaultComponentName = "text";

const defaultRegistryEntries: NamedFluidDataStoreRegistryEntries = [
];

class MyRegistry implements IFluidDataStoreRegistry {
    constructor(
        private readonly context: IContainerContext,
        private readonly defaultRegistry: string) {
    }

    public get IFluidDataStoreRegistry() { return this; }

    public async get(name: string): Promise<IProvideFluidDataStoreFactory | IProvideFluidDataStoreRegistry> {
        const scope = `${name.split("/")[0]}:cdn`;
        const config = {};
        config[scope] = this.defaultRegistry;

        const codeDetails = {
            package: name,
            config,
        };
        const fluidModule = await this.context.codeLoader.load(codeDetails);
        const moduleExport = fluidModule.fluidExport;
        assert(moduleExport.IFluidDataStoreFactory !== undefined ||
            moduleExport.IFluidDataStoreRegistry  !== undefined);
        return moduleExport as IProvideFluidDataStoreFactory | IProvideFluidDataStoreRegistry;
    }
}

class SharedTextFactoryComponent implements IFluidDataStoreFactory, IRuntimeFactory {
    public static readonly type = "@fluid-example/shared-text";
    public readonly type = SharedTextFactoryComponent.type;

    public get IFluidDataStoreFactory() { return this; }
    public get IRuntimeFactory() { return this; }

    public async instantiateDataStore(context: IFluidDataStoreContext) {
        return sharedTextComponent.instantiateDataStore(context);
    }

    /**
     * Instantiates a new chaincode host
     */
    public async instantiateRuntime(context: IContainerContext): Promise<IRuntime> {
        const runtime = await ContainerRuntime.load(
            context,
            [
                ...defaultRegistryEntries,
                [SharedTextFactoryComponent.type, Promise.resolve(this)],
                [
                    "verdaccio",
                    Promise.resolve(new MyRegistry(context, "https://pragueauspkn.azureedge.net")),
                ],
            ],
            buildRuntimeRequestHandler(
                defaultRouteRequestHandler(DefaultComponentName),
                deprecated_innerRequestHandler,
            ),
        );

        // On first boot create the base component
        if (!runtime.existing) {
            await runtime.createRootDataStore(SharedTextFactoryComponent.type, DefaultComponentName);
        }

        return runtime;
    }
}

export * from "./utils";

export const fluidExport = new SharedTextFactoryComponent();
