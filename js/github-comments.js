// https://dc25.github.io/myBlog/2017/06/24/using-github-comments-in-a-jekyll-blog.html

// use of ajax vs getJSON for headers use to get markdown (body vs body_html)

function ShowComments(repo_name, comment_id, page_id) {
  $.ajax({
    url:
      "https://api.github.com/repos/" +
      repo_name +
      "/issues/" +
      comment_id +
      "/comments" +
      "?page=" +
      page_id,
    headers: { Accept: "application/vnd.github.v3.html+json" },
    dataType: "json",
    success: function (comments, textStatus, jqXHR) {
      if (1 == page_id) {
        // post button
        var url =
          "https://github.com/" +
          repo_name +
          "/issues/" +
          comment_id +
          "#new_comment_field";
        $("#gh-comments-list").append(
          "<form action='" +
            url +
            "' rel='nofollow'> <input type='submit' value='Poster un commentaire via Github' /> </form>"
        );
      }

      // Individual comments
      $.each(comments, function (i, comment) {
        var date = new Date(comment.created_at);

        var t = "<div id='gh-comment'>";
        t += "<img src='" + comment.user.avatar_url + "' width='24px'>";
        t +=
          "<b><a href='" +
          comment.user.html_url +
          "'>" +
          comment.user.login +
          "</a></b>";
        t += " posté le ";
        t += "<em>" + date.toLocaleString("fr-FR") + "</em>";
        t += "<div id='gh-comment-hr'></div>";
        t += comment.body_html;
        t += "</div>";
        $("#gh-comments-list").append(t);
      });

      // Call recursively if there are more pages to display
      var linksResponse = jqXHR.getResponseHeader("Link");
      if (linksResponse) {
        var entries = linksResponse.split(",");
        for (var j = 0; j < entries.length; j++) {
          var entry = entries[j];
          if ("next" == entry.match(/rel="([^"]*)/)[1]) {
            ShowComments(repo_name, comment_id, page_id + 1);
            break;
          }
        }
      }
    },
    error: function () {
      $("#gh-comments-list").append(
        "Les commentaires ne sont pas encore ouverts pour ce post."
      );
    },
  });
}

function DoGithubComments(repo_name, comment_id) {
  $(document).ready(function () {
    ShowComments(repo_name, comment_id, 1);
  });
}
