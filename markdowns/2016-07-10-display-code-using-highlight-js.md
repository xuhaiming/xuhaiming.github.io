As a software developer, it is very important to present a good view of example codes on tech website.
`pre` and `code` tags provide the developers possibility to put code in correct format on the website.
However, the styling and keyword highlight still need more effort to do.

Fortunately, there is a great library called Highlight JS can help us achieve this goal.
Just few lines of code following the [Highlight JS guide](https://highlightjs.org/usage)
we are able to customize our code in the website.

Although it is possible to use NPM to install the Highlight JS package,
I still prefer to directly reference the JavaScript file because in this case we can customize what are needed to be supported in this library.

After the DOM and JS has been loaded, we need initialize the Highlight JS functionality:

```
hljs.initHighlightingOnLoad();
```

We can use [Axios](https://github.com/mzabriskie/axios) to retrive the data from server.  
After the HTML has been loaded in the DOM, we can apply all texts in `pre` `code` tags with the seleted style.
Here is an example with Vue JS:

```
axios.get('content')
    .then(response => {
        this.$el.querySelectorAll('pre code').forEach(block => {
            hljs.highlightBlock(block)
        })
    })  
})
```

Then it works! Easy isn't it?
