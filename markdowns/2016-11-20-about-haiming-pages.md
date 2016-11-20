Since React JS with Redux is not that attractive for me as before, I decided to rewrite my Github Pages with something new.
Fortunately Vue JS 2.0 was just recently released. I started building the new Haiming Pages with Vue JS. 

As a software developer, I don't really have good eyes for visual design. Therefore I need some UI frameworks to help me to make the website looks fancy.
There are many great frameworks such as Bootstrap, Foundations, etc. However, I enjoy materialize css most since it is so cool visually and easy to use.

Github Pages is a great place for developer to host personal website, but there are quite a lot of limitations for the static website.
The most tough part is data, and it is so difficult to build something like CMS on Github Pages from Stretch.
Luckily we can use markdown syntax to write posts and use Ajax request to retrieve the data, which makes the website clear and simple to update.

In order to handle the relation and routing for posts. When new post created, the `post.js` should be updated. The data could be something below:

```
 const postList = [
   {
     title: 'About Haiming Pages',
     date: '2016-11-20',
     description: 'An introduction of the structure of current Haiming Pages.'
   }
 ]
```

Base on this information, an id will be generated, which is a combination of date and title. In this case it is `2016-11-20-about-haiming-pages`.
This id is used to navigate to the correct page and request for correct resources.

As the infrastructure of Haiming Pages is basically done, I hope I can keep updating and improving this website,
sharing something interesting and useful in the future.   