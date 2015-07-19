class BlogContainer extends React.Component {
    render() {
        return (
            <div id="main">
                <section className="two">
                    <div className="container">
                        <header>
                            <h2>{this.props.blog.Title}</h2>
                        </header>
                        <span>{this.props.blog.PublishDate}</span>
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