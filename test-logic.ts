const buildVariantIdentity = (
    optionDefinitions = [],
    variantOptions = {}
) => {
    const normalizedOptionLookup = new Map()

    Object.entries(variantOptions).forEach(([name, value]) => {
        const trimmedName = name.trim()
        const trimmedValue = value?.trim()

        if (!trimmedName || !trimmedValue) {
            return
        }

        normalizedOptionLookup.set(trimmedName, trimmedValue)
    })

    const orderedSelections = optionDefinitions
        .map((option) => {
            const optionName = option.name?.trim()
            const optionValue = optionName ? normalizedOptionLookup.get(optionName) : undefined

            if (!optionName || !optionValue) {
                return null
            }

            return [optionName, optionValue]
        })
        .filter(Boolean)

    if (orderedSelections.length === 0) {
        return {
            title: 'Default Variant',
            optionSignature: null,
        }
    }

    return {
        title: orderedSelections.map(([, value]) => value).join(' / '),
        optionSignature: JSON.stringify(
            orderedSelections.map(([name, value]) => [
                name.toLowerCase().replace(/\s+/g, ' '),
                value.toLowerCase().replace(/\s+/g, ' '),
            ])
        ),
    }
}

const options = [{"id":"b91e2ed3-3cdd-43a1-99b8-03391eedcd38","name":"Color","values":["Green","Maroon","Pink","Yellow","Black","Blue"]}]
const variants = [
    {
        "id":"2986caa8-2d56-416a-8dcc-a2d355ff4639",
        "title":"Green",
        "option_signature":"[[\"color\",\"green\"]]",
        "options":{"Color":"Green"}
    }
]

console.log(buildVariantIdentity(options, variants[0].options))

