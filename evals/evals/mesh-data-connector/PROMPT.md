We use Uniform and want to extend its dashboard so content editors can pull in products from our external catalog.

Build a Uniform Mesh integration (a dashboard extension) in this project that:

- Connects our external product catalog REST API as a data source. Editors configure the connection (base URL + API token) once.
- Lets an editor search the catalog and select one or more products, so a selected product can be used in a Uniform component parameter.
- Shows the connection and the product picker as custom UI inside the Uniform dashboard.

The Uniform team/project credentials for registering the integration are already configured in `.env`. The product API details are illustrative — model the connection and the picker sensibly; you don't need a live API to respond.

Do not ask questions — make reasonable decisions and build the integration.
