/**
 * Handler implementations for service catalog MCP tools.
 *
 * Contains the business logic that executes when service-catalog-related
 * MCP tools are invoked by the client.
 */

import { getTdxClient } from "../../tdx-client.js";
import type {
  Service,
  ServiceSearch,
  ServiceCreateParams,
  ServiceUpdateParams,
  ServiceOffering,
  ServiceOfferingSearch,
  ServiceOfferingCreateParams,
  ServiceOfferingUpdateParams,
  ServiceCategory,
} from "@chatt-state/node-teamdynamix";

/** Searches for services matching the given parameters. */
export async function searchServices(
  params: ServiceSearch,
): Promise<Service[]> {
  return getTdxClient().serviceCatalog.searchServices(params);
}

/** Retrieves a single service by ID. */
export async function getService(id: number): Promise<Service> {
  return getTdxClient().serviceCatalog.getService(id);
}

/** Creates a new service. */
export async function createService(
  params: ServiceCreateParams,
): Promise<Service> {
  return getTdxClient().serviceCatalog.createService(params);
}

/** Updates an existing service. */
export async function updateService(
  id: number,
  params: ServiceUpdateParams,
): Promise<Service> {
  return getTdxClient().serviceCatalog.updateService(id, params);
}

/** Searches for offerings within a service. */
export async function searchOfferings(
  serviceId: number,
  params: ServiceOfferingSearch,
): Promise<ServiceOffering[]> {
  return getTdxClient().serviceCatalog.searchOfferings(serviceId, params);
}

/** Retrieves a single offering by ID. */
export async function getOffering(
  serviceId: number,
  offeringId: number,
): Promise<ServiceOffering> {
  return getTdxClient().serviceCatalog.getOffering(serviceId, offeringId);
}

/** Creates a new offering within a service. */
export async function createOffering(
  serviceId: number,
  params: ServiceOfferingCreateParams,
): Promise<ServiceOffering> {
  return getTdxClient().serviceCatalog.createOffering(serviceId, params);
}

/** Updates an existing offering within a service. */
export async function updateOffering(
  serviceId: number,
  offeringId: number,
  params: ServiceOfferingUpdateParams,
): Promise<ServiceOffering> {
  return getTdxClient().serviceCatalog.updateOffering(
    serviceId,
    offeringId,
    params,
  );
}

/** Gets all service categories. */
export async function getCategories(): Promise<ServiceCategory[]> {
  return getTdxClient().serviceCatalog.getCategories();
}

/** Gets a single service category by ID. */
export async function getCategory(id: number): Promise<ServiceCategory> {
  return getTdxClient().serviceCatalog.getCategory(id);
}
