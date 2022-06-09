const axios = require('axios')
exports.sourceNodes = (
  { actions, createNodeId, createContentDigest },
  configmethod
) => {
  const { createNode } = actions
  const { apis } = configmethod

  // Gatsby adds a configOption that's not needed for this plugin, delete it
  delete configmethod.plugins

  const sources = []

  // Helper function that processes a result to match Gatsby's node structure
  const processResult = ({ result, endpoint, prefix }) => {
    const genId = result.id ? result.id : Math.floor(Math.random() * 1000000000);
    const nodeId = createNodeId(`${endpoint}-${genId}`)
    const nodeContent = JSON.stringify(result)
    const nodeData = Object.assign({}, result, {
      id: nodeId,
      endpointId: result.id,
      endpoint_children: result.children,
      endpoint_parent: result.parent,
      parent: null,
      children: [],
      internal: {
        type: `${prefix}${customFormat(endpoint)}`,
        content: nodeContent,
        contentDigest: createContentDigest(result),
      },
    })
    return nodeData
  }

  const appendSources = ({ url, endpoint, prefix, method, headers }) => {
    sources.push(
      fetchData(url, { method, headers })
        .then(data => {
          if (Array.isArray(data)) {
            /* if fetchData returns multiple results */
            data.forEach(result => {
              const nodeData = processResult({
                result,
                endpoint,
                prefix,
              })
              createNode(nodeData)
            })
          } else {
            // Otherwise a single result has been returned
            const nodeData = processResult({
              result: data,
              endpoint,
              prefix,
            })
            createNode(nodeData)
          }
        })
        .catch(error => console.log(error))
    )
  }

  apis.forEach(api => {
    /* check if the api request is an object with parameters */
    if (typeof api === 'object') {
      const { prefix, baseUrl, endpoints, method = 'GET', headers } = api

      /* Add some error logging if required config method are mising */
      if (!baseUrl) {
        console.log('\x1b[31m')
        console.error(
          'error gatsby-source-rest-api option requires the baseUrl parameter'
        )
        console.log('')
        return
      }

      /* object is used and endpoints are set */
      if (endpoints && endpoints.length) {
        endpoints.forEach(endpoint => {
          appendSources({
            url:
              baseUrl[baseUrl.length - 1] === '/'
                ? `${baseUrl}${endpoint}`
                : `${baseUrl}/${endpoint}`,
            endpoint,
            prefix,
            method,
            headers
          })
        })
        return
      }

      /* object is used but no endpoints are set */
      appendSources({
        url: baseUrl,
        endpoint: baseUrl,
        prefix,
        method,
        headers
      })
      return
    }

    /* The default simply expects a api url as a string and no other method */
    if (typeof api === 'string') {
      if (api.length) {
        appendSources({
          url: api,
          endpoint: api,
          prefix: 'MultiApiSource',
          method: 'GET',
        })
      }
    }
  })

  return Promise.all(sources)
}

// Helper function to fetch data
const fetchData = async (url, options = {}) => {
  const path = encodeURI(url);
  const response = await axios.get(path)
  return await response.data
}

//strips special characters and makes string camelcase
const customFormat = str => {
  return str
    .replace(/^.*\/\/[^\/]+/, '') //Removes domain
    .replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase()) //Capitalizes strings
    .replace(/\//g, '') //Removes slashes
    .replace(/\-+/g, '') //Removes hyphens
    .replace(/\s+/g, '') //Removes spaces
}

