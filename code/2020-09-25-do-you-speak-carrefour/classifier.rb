###################################
#
###################################

def trigrams(str)
    str.chars.each_cons(3).each_with_object(Array.new) { |v,a| a << v.join }
end

def trgm_cnt labels
  trgm_cnt = Hash.new(0)
  labels.each do |label|
    trigrams(label).each do |trgm|
      trgm_cnt[trgm] += 1
    end
  end
  trgm_cnt
end

def build_corpus rcpts_dump_by_retailer
    trgm_freq_by_retailer = {}
    rcpts_dump_by_retailer.each do |retailer, labels|
        trgm_freq_by_retailer[retailer] = trgm_cnt labels
    end
    trgm_freq_by_retailer
end


def compare candidate_freq, ref_freq
    # sort candidate trigrams
    ranked_in_candidate = candidate_freq.sort_by{|k,v| v}.reverse.map(&:first)

    ranked_as_in_ref = candidate_freq.keys.sort_by{|trg|  ref_freq[trg] }.reverse

    # index_rank_by_trg
    index_ranked_ref = {}
    ranked_as_in_ref.each_with_index{|trg, rk| index_ranked_ref[trg]= rk  }

    dist = 0
    ranked_in_candidate.each_with_index do |trg, rank|
        dist+= (rank - index_ranked_ref[trg]).abs
    end
    dist
end




def classify
  crf_labels = File.read('./d_export_4.txt').split("\n")
  inter_labels = File.read('./d_export_16.txt').split("\n")

  candidate = File.read('./d_export_candidate.txt').split("\n")

  rcpts_dump_by_retailer = {inter: inter_labels, crf:crf_labels}

  freq_by_retailer = build_corpus rcpts_dump_by_retailer
  candidate_freq = trgm_cnt candidate

  d_min= nil
  closest = nil
  freq_by_retailer.each do |retailer, ref_freq|
    d = compare candidate_freq, ref_freq
    if d_min.nil? || d < d_min
      closest = retailer
      d_min = d 
    end 
  end
  closest
end

classify