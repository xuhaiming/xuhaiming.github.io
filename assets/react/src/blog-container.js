class BlogContainer extends React.Component {
    render() {
        var publishDate = moment(this.props.blog.PublishDate).format('MMMM DD, YYYY');
        return (
            <div id="main">
                <section className="two">
                    <div className="container">
                        <header>
                            <h2>{this.props.blog.Title}</h2>
                        </header>
                        <p>{publishDate}</p>
                        <p className="blog-content"><span dangerouslySetInnerHTML={{__html: this.props.blog.Content}} /></p>
                    </div>
                </section>
                <section className="two">
                    <div className="container">
                        This part will be used for comments
                    </div>
                </section>
            </div>
        );
    }

}